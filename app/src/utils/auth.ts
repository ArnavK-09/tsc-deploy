async function verifyGitHubToken(token: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error("Error verifying GitHub token:", error);
    return false;
  }
}

export function extractGitHubToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.substring(7);
}

export async function validateGitHubToken(request: Request): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  const token = extractGitHubToken(request);

  if (!token) {
    return {
      success: false,
      error: "Unauthorized - Bearer token required",
    };
  }

  const isValid = await verifyGitHubToken(token);

  if (!isValid) {
    return {
      success: false,
      error: "Invalid GitHub token",
    };
  }

  return {
    success: true,
    token,
  };
}

export function createErrorResponse(message: string, status: number = 400) {
  return new Response(
    JSON.stringify({
      error: message,
      success: false,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

export function createSuccessResponse(data: any, status: number = 200) {
  return new Response(
    JSON.stringify({
      success: true,
      ...data,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
