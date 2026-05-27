FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

# Start app
CMD ["npm", "run","dev"]