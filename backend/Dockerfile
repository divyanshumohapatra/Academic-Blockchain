FROM node:20-alpine

# Install Docker CLI so backend container can invoke Fabric CLI container commands
RUN apk add --no-cache docker-cli bash

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 4000

CMD ["node", "src/server.js"]
