export interface JwtPayload {
  sub: string; // user._id
  email: string;
  workspaceId: string;
  role: string;
}

export interface JwtRefreshPayload {
  sub: string; // user._id
  tokenId: string; // unique ID stored in Redis — used for rotation
}
