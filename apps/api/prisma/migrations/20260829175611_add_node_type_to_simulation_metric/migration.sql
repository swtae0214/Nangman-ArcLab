/*
  Warnings:

  - Added the required column `node_type` to the `simulation_metrics` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "simulation_metrics" ADD COLUMN     "node_type" "component_type" NOT NULL;
