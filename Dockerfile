FROM node:22-alpine

WORKDIR /app

# Copy server package files
COPY server-package.json package.json

# Install dependencies
RUN npm install --only=production

# Copy server source code
COPY server.js .

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
