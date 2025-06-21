# Use the official Node.js 20 Alpine image as a base
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Install native dependencies required for some Node.js packages
RUN apk add --no-cache python3 make g++

# Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Install all dependencies (including devDependencies) for the build step
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the TypeScript code into JavaScript
RUN npm run build

# Prune development dependencies to keep the final image lean
RUN npm prune --production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcpserver -u 1001

# Change ownership of the app directory
RUN chown -R mcpserver:nodejs /app
USER mcpserver

# Expose the port the app runs on
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Define the command to run the application
CMD ["node", "dist/index.js"] 