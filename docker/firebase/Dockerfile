# ベースイメージとして公式 Node.js イメージを使用
FROM node:22-alpine

# 作業ディレクトリを設定
WORKDIR /usr/src/app

# Firebase CLI をインストールするための依存パッケージをインストール
RUN apk add --no-cache openjdk17-jre

RUN npm install -g firebase-tools \
  && npm cache clean --force \
  && rm -rf /root/.npm /root/.cache

# Firebase Emulator の設定ファイルをコンテナにコピー
COPY docker/firebase/.firebaserc docker/firebase/firebase.json ./

# データインポートするためのディレクトリを作成する
RUN mkdir -p /tmp/data/emulator_data

# 必要なポートを公開
EXPOSE 8080 9099 4400

# Firebase Emulator を起動
CMD ["firebase", "emulators:start", "--only", "firestore,auth", "--import", "/tmp/data/emulator_data"]
