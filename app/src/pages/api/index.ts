import { createSuccessResponse } from "@/utils/http";

export async function GET() {
  return createSuccessResponse({
    hello: "world",
  });
}
