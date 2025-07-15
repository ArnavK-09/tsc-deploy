import { JobQueue } from "./job-queue";

let isInitialized = false;

export async function initializeServices(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    console.log("🚀 Initializing tscircuit-deploy services...");

    const jobQueue = JobQueue.getInstance();
    const queueLength = await jobQueue.getQueueLength();
    
    console.log(`📊 Found ${queueLength} jobs in queue`);
    
    if (queueLength > 0) {
      console.log("🔄 Resuming job processing...");
    }

    console.log("✅ Services initialized successfully");
    isInitialized = true;

  } catch (error) {
    console.error("❌ Failed to initialize services:", error);
    throw error;
  }
}

export function getInitializationStatus(): boolean {
  return isInitialized;
} 