FROM node:20

RUN mkdir -p frontend
WORKDIR /frontend

COPY . .

RUN apt-get update && apt-get install -y git \
    && yarn install --frozen-lockfile \
    && yarn cache clean \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# RUN yarn build

EXPOSE 5001

CMD ["yarn", "dev"]