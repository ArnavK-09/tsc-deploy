import { createSuccessResponse } from "@/utils/auth";

export async function GET() {
  return createSuccessResponse({
    hello: "world",
  });
}
