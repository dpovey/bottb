/**
 * Benchmark Photos API Performance
 *
 * Tests the /api/photos endpoint with different batch sizes to determine
 * the optimal initial page size for the photos gallery.
 *
 * Usage: npx tsx src/scripts/benchmark-photos-api.ts [baseUrl]
 *
 * Example:
 *   npx tsx src/scripts/benchmark-photos-api.ts http://localhost:3000
 *   npx tsx src/scripts/benchmark-photos-api.ts https://bottb.vercel.app
 */

const BATCH_SIZES = [5, 10, 15, 20, 25, 30, 50];
const RUNS_PER_SIZE = 5;
const ORDER_MODES = ["random", "date"] as const;

interface BenchmarkResult {
  batchSize: number;
  orderMode: string;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  latencyPerPhoto: number;
  avgPayloadKb: number;
  photoCount: number;
}

interface RunResult {
  latencyMs: number;
  payloadBytes: number;
  photoCount: number;
}

async function runSingleTest(
  baseUrl: string,
  limit: number,
  order: string
): Promise<RunResult> {
  const url = `${baseUrl}/api/photos?limit=${limit}&order=${order}`;

  const start = performance.now();
  const response = await fetch(url);
  const end = performance.now();

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const payloadBytes = JSON.stringify(data).length;

  return {
    latencyMs: end - start,
    payloadBytes,
    photoCount: data.photos?.length || 0,
  };
}

async function benchmarkBatchSize(
  baseUrl: string,
  batchSize: number,
  orderMode: string
): Promise<BenchmarkResult> {
  const results: RunResult[] = [];

  // Warm-up run (discard)
  try {
    await runSingleTest(baseUrl, batchSize, orderMode);
  } catch (error) {
    console.error(`Warm-up failed for batch size ${batchSize}:`, error);
    throw error;
  }

  // Actual test runs
  for (let i = 0; i < RUNS_PER_SIZE; i++) {
    const result = await runSingleTest(baseUrl, batchSize, orderMode);
    results.push(result);

    // Small delay between runs to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const latencies = results.map((r) => r.latencyMs);
  const avgLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatencyMs = Math.min(...latencies);
  const maxLatencyMs = Math.max(...latencies);

  const avgPayloadBytes =
    results.reduce((a, b) => a + b.payloadBytes, 0) / results.length;
  const avgPhotoCount =
    results.reduce((a, b) => a + b.photoCount, 0) / results.length;

  return {
    batchSize,
    orderMode,
    avgLatencyMs: Math.round(avgLatencyMs),
    minLatencyMs: Math.round(minLatencyMs),
    maxLatencyMs: Math.round(maxLatencyMs),
    latencyPerPhoto:
      avgPhotoCount > 0 ? Math.round(avgLatencyMs / avgPhotoCount) : 0,
    avgPayloadKb: Math.round(avgPayloadBytes / 1024),
    photoCount: Math.round(avgPhotoCount),
  };
}

function printResultsTable(results: BenchmarkResult[], orderMode: string) {
  console.log(`\n📊 Results for order="${orderMode}":`);
  console.log("─".repeat(90));
  console.log(
    "│ Batch │ Avg (ms) │ Min (ms) │ Max (ms) │ Per Photo │ Payload │ Photos │"
  );
  console.log("─".repeat(90));

  for (const r of results.filter((r) => r.orderMode === orderMode)) {
    console.log(
      `│ ${r.batchSize.toString().padStart(5)} │ ${r.avgLatencyMs.toString().padStart(8)} │ ${r.minLatencyMs.toString().padStart(8)} │ ${r.maxLatencyMs.toString().padStart(8)} │ ${r.latencyPerPhoto.toString().padStart(9)} │ ${(r.avgPayloadKb + " KB").padStart(7)} │ ${r.photoCount.toString().padStart(6)} │`
    );
  }
  console.log("─".repeat(90));
}

function analyzeResults(results: BenchmarkResult[]): void {
  console.log("\n📈 Analysis:");

  for (const orderMode of ORDER_MODES) {
    const modeResults = results.filter((r) => r.orderMode === orderMode);
    if (modeResults.length === 0) continue;

    console.log(`\n  Order mode: ${orderMode}`);

    // Find the "knee" - where latency per photo starts increasing significantly
    let recommendedSize = modeResults[0].batchSize;
    let bestEfficiency = modeResults[0].latencyPerPhoto;

    for (let i = 1; i < modeResults.length; i++) {
      const curr = modeResults[i];
      const prev = modeResults[i - 1];

      // If latency per photo increased by more than 20%, the previous size was better
      if (curr.latencyPerPhoto > prev.latencyPerPhoto * 1.2) {
        break;
      }

      // Otherwise, more photos for similar per-photo cost is better
      if (curr.latencyPerPhoto <= bestEfficiency * 1.1) {
        recommendedSize = curr.batchSize;
        bestEfficiency = curr.latencyPerPhoto;
      }
    }

    const recommended = modeResults.find((r) => r.batchSize === recommendedSize);
    if (recommended) {
      console.log(
        `  ✅ Recommended initial batch size: ${recommendedSize} photos`
      );
      console.log(
        `     - Total latency: ${recommended.avgLatencyMs}ms`
      );
      console.log(
        `     - Per photo: ${recommended.latencyPerPhoto}ms`
      );
      console.log(`     - Payload: ${recommended.avgPayloadKb} KB`);
    }

    // Compare with current (50)
    const current = modeResults.find((r) => r.batchSize === 50);
    if (current && recommended && recommendedSize !== 50) {
      const improvement = Math.round(
        ((current.avgLatencyMs - recommended.avgLatencyMs) /
          current.avgLatencyMs) *
          100
      );
      console.log(
        `     - ${improvement}% faster than current (50 photos @ ${current.avgLatencyMs}ms)`
      );
    }
  }
}

async function main() {
  const baseUrl = process.argv[2] || "http://localhost:3000";

  console.log("🚀 Photos API Benchmark");
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   Batch sizes: ${BATCH_SIZES.join(", ")}`);
  console.log(`   Runs per size: ${RUNS_PER_SIZE}`);
  console.log(`   Order modes: ${ORDER_MODES.join(", ")}`);
  console.log("");

  const allResults: BenchmarkResult[] = [];

  for (const orderMode of ORDER_MODES) {
    console.log(`\n⏱️  Testing order="${orderMode}"...`);

    for (const batchSize of BATCH_SIZES) {
      process.stdout.write(`   Batch size ${batchSize}... `);

      try {
        const result = await benchmarkBatchSize(baseUrl, batchSize, orderMode);
        allResults.push(result);
        console.log(
          `${result.avgLatencyMs}ms avg (${result.latencyPerPhoto}ms/photo)`
        );
      } catch (error) {
        console.log(`FAILED: ${error}`);
      }
    }
  }

  // Print results tables
  for (const orderMode of ORDER_MODES) {
    printResultsTable(allResults, orderMode);
  }

  // Analyze and recommend
  analyzeResults(allResults);

  console.log("\n✅ Benchmark complete!");
}

main().catch((error) => {
  console.error("Benchmark failed:", error);
  process.exit(1);
});

