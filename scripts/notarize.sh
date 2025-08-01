#!/bin/bash

# 公证脚本
set -e

# 配置
APP_PATH="/Users/stone/Works/12Particles/Pivo/src-tauri/target/release/bundle/macos/Pivo.app"
DMG_PATH="/Users/stone/Works/12Particles/Pivo/src-tauri/target/release/bundle/dmg/Pivo_0.1.2_aarch64.dmg"
TEAM_ID="9WZQSGSX3A"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}开始公证流程...${NC}"

# 检查环境变量
if [ -z "$APPLE_ID" ]; then
    echo -e "${RED}错误: 请设置 APPLE_ID 环境变量${NC}"
    echo -e "${YELLOW}export APPLE_ID='your-apple-id@example.com'${NC}"
    exit 1
fi

if [ -z "$APPLE_PASSWORD" ]; then
    echo -e "${RED}错误: 请设置 APPLE_PASSWORD 环境变量${NC}"
    echo -e "${YELLOW}1. 访问 https://appleid.apple.com${NC}"
    echo -e "${YELLOW}2. 登录后，在安全性部分生成 App 专用密码${NC}"
    echo -e "${YELLOW}3. export APPLE_PASSWORD='xxxx-xxxx-xxxx-xxxx'${NC}"
    exit 1
fi

# 检查文件
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}错误: 找不到应用 $APP_PATH${NC}"
    echo -e "${YELLOW}请先运行: pnpm tauri build${NC}"
    exit 1
fi

# 创建用于公证的 ZIP
echo -e "${YELLOW}创建 ZIP 文件...${NC}"
ZIP_PATH="${APP_PATH%.*}.zip"
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

# 提交公证
echo -e "${YELLOW}提交公证 (这可能需要几分钟)...${NC}"
xcrun notarytool submit "$ZIP_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_PASSWORD" \
    --team-id "$TEAM_ID" \
    --wait \
    --verbose

# 如果公证成功，装订票据
if [ $? -eq 0 ]; then
    echo -e "${GREEN}公证成功！${NC}"
    
    echo -e "${YELLOW}装订公证票据到应用...${NC}"
    xcrun stapler staple "$APP_PATH"
    
    # 如果有 DMG，也装订到 DMG
    if [ -f "$DMG_PATH" ]; then
        echo -e "${YELLOW}装订公证票据到 DMG...${NC}"
        xcrun stapler staple "$DMG_PATH"
    fi
    
    # 清理 ZIP
    rm -f "$ZIP_PATH"
    
    echo -e "${GREEN}✅ 公证完成！${NC}"
    echo -e "${GREEN}应用现在可以在任何 Mac 上运行了。${NC}"
    
    # 验证
    echo -e "${YELLOW}验证公证状态...${NC}"
    spctl -a -vvv -t open --context context:primary-open "$APP_PATH"
    
else
    echo -e "${RED}公证失败！${NC}"
    echo -e "${YELLOW}请检查上面的错误信息${NC}"
    
    # 清理 ZIP
    rm -f "$ZIP_PATH"
    
    exit 1
fi