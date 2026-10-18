import os
import requests
import re
import json
import zipfile
import io
from datetime import datetime

GITHUB_REPO = "zicceho/beilog"
PODCAST_REPO = "zicceho/podcast-automation" # 你的私有仓库名
TG_TOKEN = os.environ.get("TG_BOT_TOKEN")
TG_CHAT = os.environ.get("TG_CHAT_ID")
GH_TOKEN = os.environ.get("GH_TOKEN")

PAGES_FILE_LIMIT = 20000
WARN_THRESHOLD = int(PAGES_FILE_LIMIT * 0.7)
CRITICAL_THRESHOLD = int(PAGES_FILE_LIMIT * 0.8)

headers = {
    "Authorization": f"Bearer {GH_TOKEN}",
    "Accept": "application/vnd.github+json"
}

def get_file_count_from_logs(run_id):
    url = f"https://api.github.com/repos/{GITHUB_REPO}/actions/runs/{run_id}/logs"
    r = requests.get(url, headers=headers, allow_redirects=True)
    if r.status_code != 200:
        return None
    try:
        z = zipfile.ZipFile(io.BytesIO(r.content))
        for name in z.namelist():
            if "build-and-deploy" in name or "check" in name:
                text = z.read(name).decode('utf-8', errors='ignore')
                match = re.search(r"out 文件数:\s*(\d+)", text)
                if match:
                    return int(match.group(1))
    except Exception:
        pass
    return None

def get_latest_workflow(repo, workflow_file):
    url = f"https://api.github.com/repos/{repo}/actions/workflows/{workflow_file}/runs?per_page=1"
    r = requests.get(url, headers=headers)
    if r.status_code == 200 and r.json().get("workflow_runs"):
        return r.json()["workflow_runs"][0]
    return None

def send_message(text):
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    payload = {"chat_id": TG_CHAT, "text": text, "parse_mode": "Markdown", "disable_web_page_preview": True}
    requests.post(url, json=payload)

def main():
    date_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    # 1. 获取主站构建状态
    build_run = get_latest_workflow(GITHUB_REPO, "build-and-deploy.yml")
    if build_run:
        build_time = datetime.fromisoformat(build_run["updated_at"].replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M")
        build_status = "✅ 成功" if build_run["conclusion"] == "success" else f"❌ {build_run['conclusion']}"
        file_count = get_file_count_from_logs(build_run["id"]) if build_run["conclusion"] == "success" else None
    else:
        build_time, build_status, file_count = "未知", "未知", None

    # 2. 获取抓取状态
    sync_run = get_latest_workflow(PODCAST_REPO, "sync.yml")
    if sync_run:
        sync_time = datetime.fromisoformat(sync_run["updated_at"].replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M")
        sync_status = "✅ 成功" if sync_run["conclusion"] == "success" else f"❌ {sync_run['conclusion']}"
    else:
        sync_time, sync_status = "未知", "未知"

    # 3. 拼装日报
    msg = f"📊 *播客站运行日报* ({date_str})\n\n"
    msg += f"🚀 *网站部署*: {build_status}\n   └ 时间: {build_time}\n"
    msg += f"📡 *RSS抓取*: {sync_status}\n   └ 时间: {sync_time}\n\n"

    if file_count is not None:
        percent = (file_count / PAGES_FILE_LIMIT) * 100
        msg += f"📁 *Pages 文件数*: `{file_count} / {PAGES_FILE_LIMIT}` ({percent:.1f}%)\n"
        if file_count >= CRITICAL_THRESHOLD:
            msg += "\n🚨 *【紧急通知】文件数已超 80%！*\n请立即按以下步骤迁移 R2：\n"
            msg += "1. GitHub Variables 改 `DEPLOY_TARGET` 为 `r2`\n2. CF 解除正式域名绑定\n3. 把域名绑到 R2 桶\n4. 三条规则改正式域名\n5. 清除CF域名 配置 缓存"
        elif file_count >= WARN_THRESHOLD:
            msg += "\n⚠️ *【预警】文件数已超 70%，请准备迁移 R2。*"
        else:
            msg += "\n✅ *状态良好，安心创作即可。*"
    else:
        msg += "📁 *Pages 文件数*: 解析失败，请查看 Actions 日志。\n"
    
    msg += "\n\n☁️ *Workers & R2 额度*：如需显示，请配置 CF API 权限（当前未配置）。"

    send_message(msg)

if __name__ == "__main__":
    main()
