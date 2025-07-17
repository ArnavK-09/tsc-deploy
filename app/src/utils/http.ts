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
