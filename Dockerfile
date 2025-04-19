FROM node:18-slim

# puppeteer용 환경 변수 (Chromium 포함 버전 강제 설치)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# 필요한 패키지 설치
RUN apt-get update && apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libgbm1 libasound2 \
  libpangocairo-1.0-0 libxss1 libgtk-3-0 libxshmfence1 libglu1 fonts-noto \
  && apt-get clean

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["npm", "start"]
