FROM node:18-alpine

WORKDIR /app

# Copy package.json if it exists, otherwise create minimal one
COPY package.json* ./
RUN if [ -f package.json ]; then npm install --production; fi

# Copy bridge script
COPY waha-bridge.js ./

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "if (!process.env.WAHA_BASE_URL) throw new Error('Not healthy')" || exit 1

# Run bridge
CMD ["node", "waha-bridge.js"]
