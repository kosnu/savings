# ベースイメージとして公式 Node.js イメージを使用
FROM node:22-slim

# 作業ディレクトリを設定
WORKDIR /usr/src/app

# Firebase CLI をインストールするための依存パッケージをインストール
RUN apt-get update && apt-get install -y openjdk-17-jdk && apt-get clean

# Firebase CLI をグローバルにインストール
RUN npm install -g firebase-tools

# Firebase Emulator の設定ファイルをコンテナにコピー
COPY docker/firebase/.firebaserc docker/firebase/firebase.json ./

# 必要なポートを公開
EXPOSE 8080 9099 4400

# Firebase Emulator を起動
CMD ["firebase", "emulators:start", "--only", "firestore,auth"]
