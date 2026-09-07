-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "component_type" ADD VALUE 'VPN_GATEWAY';
ALTER TYPE "component_type" ADD VALUE 'DIRECT_CONNECT';
ALTER TYPE "component_type" ADD VALUE 'TRANSIT_GATEWAY';
ALTER TYPE "component_type" ADD VALUE 'NAT_GATEWAY';
ALTER TYPE "component_type" ADD VALUE 'INTERNET_GATEWAY';
ALTER TYPE "component_type" ADD VALUE 'WAF';
ALTER TYPE "component_type" ADD VALUE 'SHIELD';
ALTER TYPE "component_type" ADD VALUE 'API_GATEWAY';
ALTER TYPE "component_type" ADD VALUE 'ROUTE53';
ALTER TYPE "component_type" ADD VALUE 'LAMBDA';
ALTER TYPE "component_type" ADD VALUE 'SQS';
ALTER TYPE "component_type" ADD VALUE 'SNS';
ALTER TYPE "component_type" ADD VALUE 'S3';
