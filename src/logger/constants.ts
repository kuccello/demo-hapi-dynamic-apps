export const CommonRegExes = {
  email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi,
  accessToken: /access[_-]?token=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/gi,
  sslSecretKey: /ssl[_-]?secret[_-]?key=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/gi,
  ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
  sessionToken: /session[_-]?token=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/gi,
  jwt: /eyJ[a-zA-Z0-9-_]+\.eyJ[a-zA-Z0-9-_]+\.?[a-zA-Z0-9-_]*\b/g,
  jwtAccessTokenRegex: /access[_-]?token=["']?eyJ[a-zA-Z0-9-_]+\.eyJ[a-zA-Z0-9-_]+\.?[a-zA-Z0-9-_]*\b["']?/gi,
  jwtRefreshTokenRegex: /refresh[_-]?token=["']?eyJ[a-zA-Z0-9-_]+\.eyJ[a-zA-Z0-9-_]+\.?[a-zA-Z0-9-_]*\b["']?/gi,
  // add more regexes for other types of sensitive data
};