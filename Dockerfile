FROM oven/bun:1.3.10-slim
WORKDIR /app
EXPOSE 5173
CMD ["bun", "run", "--filter", "@opmodel/web", "dev"]
