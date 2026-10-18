import os
import requests
import re
import zipfile
import io
from datetime import datetime, timedelta, timezone

GITHUB_REPO = "zicceho/beilog"
PODCAST_REPO = "zicceho/podcast-automation"
TG_TOKEN = os.environ.get("TG_BOT_TOKEN")
TG_CHAT = os.environ.get("TG_CHAT_ID")
GH_TOKEN = os.environ.get("GH_TOKEN")

CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
CF_ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
CF_PAGES_PROJECT = os.environ.get("PAGES_PROJECT", "beilog-new")

PAGES_FILE_LIMIT = 20000
WARN_THRESHOLD = int(PAGES_FILE_LIMIT * 0.7)
CRITICAL_THRESHOLD = int(PAGES_FILE_LIMIT * 0.8)

GH_HEADERS = {
    "Authorization": f"Bearer {GH_TOKEN}",
    "Accept": "application/vnd.github+json"
}

CF_HEADERS = {
    "Authorization": f"Bearer {CF_TOKEN}",
    "Content-Type": "application/json"
}

def get_run_details(repo, run_id, extract_files=False, find_errors=False):
    url = f"https://api.github.com/repos/{repo}/actions/runs/{run_id}/logs"
    # 关键：必须允许重定向，因为GitHub会返回302到临时下载地址
    r = requests.get(url, headers=GH_HEADERS, allow_redirects=True)
    
    if r.status_code != 200:
        return None, [f"日志下载失败 (HTTP {r.status_code})"]
    
    file_count = None
    errors = []
    
    try:
        z = zipfile.ZipFile(io.BytesIO(r.content))
        for name in z.namelist():
            text = z.read(name).decode('utf-8', errors='ignore')
            if extract_files and ("build-and-deploy" in name or "check" in name):
                match = re.search(r"out 文件数:\s*(\d+)", text)
                if match:
                    file_count = int(match.group(1))
            if find_errors:
                for line in text.splitlines():
                    if any(keyword in line for keyword in ["ERROR", "Error", "error:", "Exception", "失败:", "错误:"]):
                        if "::warning::" not in line and "Warning:" not in line:
                            errors.append(line.strip())
    except Exception as e:
        errors.append(f"解析日志时出错: {str(e)}")
        
    # 确保有返回值
    return file_count, (errors[-2:] if errors else ["未找到错误关键字，请点击日志链接查看"])

def get_latest_workflow(repo, workflow_file):
    url = f"https://api.github.com/repos/{repo}/actions/workflows/{workflow_file}/runs?per_page=1"
    r = requests.get(url, headers=GH_HEADERS)
    if r.status_code == 200 and r.json().get("workflow_runs"):
        return r.json()["workflow_runs"][0]
    return None

def get_github_actions_usage():
    since = (datetime.now(timezone.utc) - timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%SZ')
    url = f"https://api.github.com/repos/{PODCAST_REPO}/actions/runs?created=>{since}&per_page=100"
    r = requests.get(url, headers=GH_HEADERS)
    if r.status_code == 200:
        runs = r.json().get("workflow_runs", [])
        total_seconds = 0
        for run in runs:
            if run["status"] == "completed" and run.get("run_started_at") and run.get("updated_at"):
                start = datetime.fromisoformat(run["run_started_at"].replace("Z", "+00:00"))
                end = datetime.fromisoformat(run["updated_at"].replace("Z", "+00:00"))
                total_seconds += (end - start).total_seconds()
        minutes = int(total_seconds / 60)
        return f"已用 {minutes} 分钟 / 2000 分钟 ({minutes/2000*100:.1f}%)"
    return "获取失败"

def get_cf_pages_usage():
    if not CF_TOKEN or not CF_ACCOUNT:
        return "未配置密钥"
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/pages/projects/{CF_PAGES_PROJECT}/deployments"
    r = requests.get(url, headers=CF_HEADERS, params={"env": "production", "per_page": 100})
    if r.status_code == 200:
        data = r.json().get("result", [])
        current_month = datetime.now().month
        count = sum(1 for d in data if datetime.fromisoformat(d["created_on"].replace("Z", "+00:00")).month == current_month)
        return f"已用 {count} 次 / 500 次 ({count/500*100:.1f}%)"
    # 返回更具体的错误信息
    error_msg = r.json().get("errors", [{}])[0].get("message", "未知错误")
    return f"查询失败: {error_msg}"

def get_cf_r2_usage():
    if not CF_TOKEN or not CF_ACCOUNT:
        return "未配置密钥"
    url = "https://api.cloudflare.com/client/v4/graphql"
    # 更完整的 GraphQL 查询，包含必要的时间过滤
    query = """
    query getR2Usage($accountId: String!, $startDate: Time!, $endDate: Time!) {
      viewer {
        accounts(filter: {accountTag: $accountId}) {
          r2StorageAdaptiveGroups(
            limit: 1,
            filter: { datetime_geq: $startDate, datetime_leq: $endDate },
            orderBy: [date_DESC]
          ) {
            max { payloadSize objectCount }
          }
        }
      }
    }
    """
    variables = {
        "accountId": CF_ACCOUNT,
        "startDate": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        "endDate": datetime.now(timezone.utc).isoformat()
    }
    try:
        r = requests.post(url, headers=CF_HEADERS, json={"query": query, "variables": variables})
        if r.status_code == 200:
            data = r.json()
            if "errors" in data:
                return f"查询错误: {data['errors'][0].get('message', '')}"
            groups = data["data"]["viewer"]["accounts"][0]["r2StorageAdaptiveGroups"]
            if groups:
                payload_size = groups[0]["max"]["payloadSize"]
                object_count = groups[0]["max"]["objectCount"]
                gb = payload_size / (1024**3)
                return f"已用 {gb:.2f} GB / 10 GB ({gb/10*100:.1f}%)"
        return "未获取到数据 (桶为空或查询无结果)"
    except Exception as e:
        return f"查询异常: {str(e)}"

def send_message(text):
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    payload = {"chat_id": TG_CHAT, "text": text, "parse_mode": "Markdown", "disable_web_page_preview": True}
    requests.post(url, json=payload)

def main():
    date_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    # 1. 部署状态
    build_run = get_latest_workflow(GITHUB_REPO, "build-and-deploy.yml")
    if build_run:
        build_id = build_run["id"]
        build_time = datetime.fromisoformat(build_run["updated_at"].replace("Z", "+00:00")).strftime("%m-%d %H:%M")
        build_url = f"https://github.com/{GITHUB_REPO}/actions/runs/{build_id}"
        if build_run["conclusion"] == "success":
            build_status = f"✅ [成功]({build_url})"
            file_count, _ = get_run_details(GITHUB_REPO, build_id, extract_files=True)
        else:
            build_status = f"❌ [失败]({build_url})"
            _, errs = get_run_details(GITHUB_REPO, build_id, find_errors=True)
            err_msg = errs[-1] if errs else "未知错误"
            build_status += f"\n   └ {err_msg[:100]}" # 显示更多错误字符
            file_count = None
    else:
        build_time, build_status, file_count, build_url = "未知", "未知", None, ""

    # 2. 抓取状态
    sync_run = get_latest_workflow(PODCAST_REPO, "sync.yml")
    if sync_run:
        sync_id = sync_run["id"]
        sync_time = datetime.fromisoformat(sync_run["updated_at"].replace("Z", "+00:00")).strftime("%m-%d %H:%M")
        sync_url = f"https://github.com/{PODCAST_REPO}/actions/runs/{sync_id}"
        if sync_run["conclusion"] == "success":
            sync_status = f"✅ [成功]({sync_url})"
        else:
            sync_status = f"❌ [失败]({sync_url})"
            _, errs = get_run_details(PODCAST_REPO, sync_id, find_errors=True)
            err_msg = errs[-1] if errs else "未知错误，请点击链接查看日志"
            sync_status += f"\n   └ {err_msg[:100]}"
    else:
        sync_time, sync_status = "未知", "未知"

    # 3. 真实额度获取
    gh_usage = get_github_actions_usage()
    cf_pages = get_cf_pages_usage()
    cf_r2 = get_cf_r2_usage()

    # 4. 拼装
    msg = f"📊 *播客站运行日报* ({date_str})\n\n"
    msg += f"🚀 *网站部署*: {build_status}\n   └ 时间: {build_time}\n"
    msg += f"📡 *RSS抓取*: {sync_status}\n   └ 时间: {sync_time}\n\n"
    
    msg += f"📁 *Pages 文件数*:\n"
    if file_count is not None:
        percent = (file_count / PAGES_FILE_LIMIT) * 100
        msg += f"   └ `{file_count} / {PAGES_FILE_LIMIT}` ({percent:.1f}%)\n"
    else:
        msg += f"   └ 解析失败，[查日志]({build_url})\n"

    msg += f"\n📈 *额度实时监控*:\n"
    msg += f"   ├ 🔨 *Pages 构建*: {cf_pages}\n"
    msg += f"   ├ 💾 *R2 存储*: {cf_r2}\n"
    msg += f"   ├ ⏱️ *Actions(私有仓)*: {gh_usage}\n"
    msg += f"   └ ♾️ *Actions(公开仓)*: 免费无限量\n\n"

    if file_count is not None:
        if file_count >= CRITICAL_THRESHOLD:
            msg += "🚨 *【紧急】文件数超 80%！请立即迁移 R2。*"
        elif file_count >= WARN_THRESHOLD:
            msg += "⚠️ *【预警】文件数超 70%，准备迁移。*"
        else:
            msg += "✅ *系统运行良好，安心创作！*"

    send_message(msg)

if __name__ == "__main__":
    main()
