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
    r = requests.get(url, headers=GH_HEADERS, allow_redirects=True)

    if r.status_code != 200:
        return None, [f"日志下载失败 (HTTP {r.status_code})"]

    file_count = None
    errors = []

    try:
        z = zipfile.ZipFile(io.BytesIO(r.content))
        for name in z.namelist():
            text = z.read(name).decode('utf-8', errors='ignore')
            if extract_files:
                for pattern in [r"out 文件数[:：]\s*(\d+)", r"文件数[:：]\s*(\d+)", r"Total files[:：]\s*(\d+)"]:
                    match = re.search(pattern, text)
                    if match:
                        file_count = int(match.group(1))
                        break
            if find_errors:
                for line in text.splitlines():
                    if any(keyword in line for keyword in ["ERROR", "Error", "error:", "Exception", "失败:", "错误:"]):
                        if "::warning::" not in line and "Warning:" not in line:
                            errors.append(line.strip())
    except Exception as e:
        errors.append(f"解析日志出错: {str(e)}")

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
                try:
                    start_str = run["run_started_at"].replace("Z", "+00:00")
                    end_str = run["updated_at"].replace("Z", "+00:00")
                    if "." in start_str:
                        start_str = start_str[:start_str.find('.') + 7] + start_str[start_str.find('+') - 1:]
                    if "." in end_str:
                        end_str = end_str[:end_str.find('.') + 7] + end_str[end_str.find('+') - 1:]

                    start = datetime.fromisoformat(start_str)
                    end = datetime.fromisoformat(end_str)
                    total_seconds += (end - start).total_seconds()
                except Exception:
                    pass
        minutes = int(total_seconds / 60)
        return f"已用 {minutes} 分钟 / 2000 分钟 ({minutes / 2000 * 100:.1f}%)"
    return "获取失败"


def get_cf_pages_usage():
    if not CF_TOKEN or not CF_ACCOUNT:
        return "未配置密钥"
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/pages/projects/{CF_PAGES_PROJECT}/deployments"
    r = requests.get(url, headers=CF_HEADERS, params={"env": "production", "per_page": 25})
    if r.status_code == 200:
        data = r.json().get("result", [])
        current_month = datetime.now().month
        count = 0
        for d in data:
            try:
                created_month = int(d["created_on"][5:7])
                if created_month == current_month:
                    count += 1
            except Exception:
                pass
        return f"已用 {count} 次 / 500 次 ({count / 500 * 100:.1f}%)"
    error_msg = r.json().get("errors", [{}])[0].get("message", "未知错误")
    return f"查询失败: {error_msg}"


def get_cf_r2_usage():
    if not CF_TOKEN or not CF_ACCOUNT:
        return "未配置密钥"
    url = "https://api.cloudflare.com/client/v4/graphql"
    # 修复：使用 date 字段（Date type）而非 datetime（Time type）
    query = """
    query getR2Usage($accountId: String!, $startDate: Date!, $endDate: Date!) {
      viewer {
        accounts(filter: {accountTag: $accountId}) {
          r2StorageAdaptiveGroups(
            limit: 1,
            filter: { date_geq: $startDate, date_leq: $endDate },
            orderBy: [date_DESC]
          ) {
            max { payloadSize objectCount }
          }
        }
      }
    }
    """
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime('%Y-%m-%d')
    variables = {
        "accountId": CF_ACCOUNT,
        "startDate": yesterday,
        "endDate": today
    }
    try:
        r = requests.post(url, headers=CF_HEADERS, json={"query": query, "variables": variables})
        if r.status_code == 200:
            data = r.json()
            if "errors" in data:
                return f"查询错误: {data['errors'][0].get('message', '')}"
            try:
                groups = data["data"]["viewer"]["accounts"][0]["r2StorageAdaptiveGroups"]
                if groups and groups[0]["max"]["payloadSize"] is not None:
                    payload_size = groups[0]["max"]["payloadSize"]
                    gb = payload_size / (1024 ** 3)
                    return f"已用 {gb:.2f} GB / 10 GB ({gb / 10 * 100:.1f}%)"
            except (KeyError, IndexError, TypeError):
                pass
            return "已用 0.00 GB / 10 GB (0%) - 桶为空"
        return f"查询失败: HTTP {r.status_code}"
    except Exception as e:
        return f"查询异常: {str(e)}"


def send_message(text):
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    payload = {"chat_id": TG_CHAT, "text": text, "parse_mode": "Markdown", "disable_web_page_preview": True}
    requests.post(url, json=payload)


def main():
    date_str = datetime.now().strftime("%Y-%m-%d %H:%M")

    build_run = get_latest_workflow(GITHUB_REPO, "build-and-deploy.yml")
    if build_run:
        build_id = build_run["id"]
        try:
            build_time = datetime.fromisoformat(build_run["updated_at"].replace("Z", "+00:00")).strftime("%m-%d %H:%M")
        except:
            build_time = build_run["updated_at"][5:16].replace("T", " ")
        build_url = f"https://github.com/{GITHUB_REPO}/actions/runs/{build_id}"
        if build_run["conclusion"] == "success":
            build_status = f"✅ [成功]({build_url})"
            file_count, _ = get_run_details(GITHUB_REPO, build_id, extract_files=True)
        else:
            build_status = f"❌ [失败]({build_url})"
            _, errs = get_run_details(GITHUB_REPO, build_id, find_errors=True)
            err_msg = errs[-1] if errs else "未知错误"
            build_status += f"\n   └ {err_msg[:100]}"
            file_count = None
    else:
        build_time, build_status, file_count, build_url = "未知", "未知", None, ""

    sync_run = get_latest_workflow(PODCAST_REPO, "sync.yml")
    if sync_run:
        sync_id = sync_run["id"]
        try:
            sync_time = datetime.fromisoformat(sync_run["updated_at"].replace("Z", "+00:00")).strftime("%m-%d %H:%M")
        except:
            sync_time = sync_run["updated_at"][5:16].replace("T", " ")
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

    gh_usage = get_github_actions_usage()
    cf_pages = get_cf_pages_usage()
    cf_r2 = get_cf_r2_usage()

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
            msg += "🚨 *【紧急通知】文件数已超 80%！请立即迁移到 R2！*\n\n"
            msg += "*【完整迁移操作步骤】*：\n"
            msg += "1️⃣ *GitHub 修改变量*：进入仓库 Settings -> Secrets and variables -> Actions -> Variables，把 `DEPLOY_TARGET` 的值改为 `r2`。\n\n"
            msg += "2️⃣ *CF 解除域名*：进入 Cloudflare 的旧 Pages 项目 -> Custom domains，移除你的正式域名。\n\n"
            msg += "3️⃣ *CF 绑定 R2*：进入 R2 存储桶 -> Settings -> Custom Domains，添加你的正式域名。\n\n"
            msg += "4️⃣ *CF 修改规则*：进入域名规则 (Rules -> Transform Rules -> Rewrite URL)，把三条规则里的测试域名改成正式域名。\n\n"
            msg += "5️⃣ *CF 清除缓存*：去 CF 首页 -> 点击你的正式域名 -> 左侧菜单找 缓存 (Caching) -> 配置 (Configuration) -> 点击 清除所有内容 (Purge Everything)。\n\n"
            msg += "⚠️ *务必确认第 5 步做完，否则用户可能看到旧页面！*"
        elif file_count >= WARN_THRESHOLD:
            msg += "⚠️ *【预警】文件数已超 70%，请开始准备迁移 R2。*\n"
            msg += "当前无需立刻操作，但请提前熟悉上述 5 步操作流程。"
        else:
            msg += "✅ *系统运行良好，安心创作！*"

    send_message(msg)


if __name__ == "__main__":
    main()
