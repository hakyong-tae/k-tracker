name: Update MyResult Data

on:
  schedule:
    - cron: '0 * * * *'  # 매 시간마다 실행
  workflow_dispatch:  # 수동 실행도 가능

jobs:
  update:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repo
        uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run parse + copy
        run: npm run parse

      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/data/myresult_races_parsed.json
          git commit -m "📦 자동 업데이트: 대회 목록" || echo "No changes to commit"
          git push
