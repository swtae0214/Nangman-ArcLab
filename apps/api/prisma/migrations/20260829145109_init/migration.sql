-- CreateEnum
CREATE TYPE "component_type" AS ENUM ('LOAD_BALANCER', 'WEB_SERVER', 'DB_PRIMARY', 'DB_REPLICA', 'CACHE', 'CDN', 'AUTO_SCALING_GROUP', 'MULTI_AZ_GROUP', 'MULTI_REGION_GROUP');

-- CreateEnum
CREATE TYPE "rule_severity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "rule_category" AS ENUM ('RELIABILITY', 'PERFORMANCE');

-- CreateEnum
CREATE TYPE "scenario_phase" AS ENUM ('BASELINE', 'DURING_FAILURE');

-- CreateTable
CREATE TABLE "architectures" (
    "id" TEXT NOT NULL,
    "owner_token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "graph_json" JSONB NOT NULL,
    "share_token" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "architectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_presets" (
    "code" TEXT NOT NULL,
    "component_type" "component_type" NOT NULL,
    "display_name" TEXT NOT NULL,
    "service_rate_rps" DECIMAL(10,2) NOT NULL,
    "source_note" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "component_presets_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "failure_scenarios" (
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "default_duration_sec" INTEGER NOT NULL,
    "affects_rule" JSONB NOT NULL,

    CONSTRAINT "failure_scenarios_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "validation_rules" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "default_severity" "rule_severity" NOT NULL,
    "source_citation" TEXT NOT NULL,
    "category" "rule_category" NOT NULL,

    CONSTRAINT "validation_rules_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "simulation_runs" (
    "id" TEXT NOT NULL,
    "architecture_id" TEXT NOT NULL,
    "architecture_snapshot" JSONB NOT NULL,
    "target_availability" DECIMAL(5,3) NOT NULL,
    "expected_rps" DECIMAL(10,2) NOT NULL,
    "failure_scenario_code" TEXT,
    "failure_duration_sec" INTEGER,
    "observation_period_sec" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_results" (
    "id" TEXT NOT NULL,
    "simulation_run_id" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "severity_at_run" "rule_severity" NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_metrics" (
    "id" TEXT NOT NULL,
    "simulation_run_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "scenario_phase" "scenario_phase" NOT NULL,
    "lambda_rps" DECIMAL(10,2) NOT NULL,
    "mu_rps" DECIMAL(10,2) NOT NULL,
    "c_servers" INTEGER NOT NULL,
    "rho" DECIMAL(6,4) NOT NULL,
    "avg_latency_ms" DECIMAL(10,2) NOT NULL,
    "throughput_rps" DECIMAL(10,2) NOT NULL,
    "is_saturated" BOOLEAN NOT NULL,

    CONSTRAINT "simulation_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "architectures_share_token_key" ON "architectures"("share_token");

-- CreateIndex
CREATE INDEX "architectures_owner_token_idx" ON "architectures"("owner_token");

-- CreateIndex
CREATE INDEX "simulation_runs_architecture_id_idx" ON "simulation_runs"("architecture_id");

-- CreateIndex
CREATE INDEX "validation_results_simulation_run_id_idx" ON "validation_results"("simulation_run_id");

-- CreateIndex
CREATE INDEX "simulation_metrics_simulation_run_id_idx" ON "simulation_metrics"("simulation_run_id");

-- AddForeignKey
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_architecture_id_fkey" FOREIGN KEY ("architecture_id") REFERENCES "architectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_failure_scenario_code_fkey" FOREIGN KEY ("failure_scenario_code") REFERENCES "failure_scenarios"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_simulation_run_id_fkey" FOREIGN KEY ("simulation_run_id") REFERENCES "simulation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_rule_code_fkey" FOREIGN KEY ("rule_code") REFERENCES "validation_rules"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_metrics" ADD CONSTRAINT "simulation_metrics_simulation_run_id_fkey" FOREIGN KEY ("simulation_run_id") REFERENCES "simulation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
