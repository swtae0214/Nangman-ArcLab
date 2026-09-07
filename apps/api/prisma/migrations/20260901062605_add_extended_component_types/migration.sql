-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "component_type" ADD VALUE 'REGION';
ALTER TYPE "component_type" ADD VALUE 'AWS_CLOUD';
ALTER TYPE "component_type" ADD VALUE 'VPC';
ALTER TYPE "component_type" ADD VALUE 'PUBLIC_SUBNET';
ALTER TYPE "component_type" ADD VALUE 'PRIVATE_SUBNET';
ALTER TYPE "component_type" ADD VALUE 'AVAILABILITY_ZONE';
ALTER TYPE "component_type" ADD VALUE 'CORPORATE_DATACENTER';
ALTER TYPE "component_type" ADD VALUE 'IOT_CORE';
ALTER TYPE "component_type" ADD VALUE 'KINESIS_DATA_STREAMS';
ALTER TYPE "component_type" ADD VALUE 'KINESIS_DATA_FIREHOSE';
ALTER TYPE "component_type" ADD VALUE 'AURORA';
ALTER TYPE "component_type" ADD VALUE 'COGNITO';
ALTER TYPE "component_type" ADD VALUE 'DOCUMENT_DB';
ALTER TYPE "component_type" ADD VALUE 'CODEPIPELINE';
ALTER TYPE "component_type" ADD VALUE 'CODEBUILD';
ALTER TYPE "component_type" ADD VALUE 'CLOUDFORMATION';
ALTER TYPE "component_type" ADD VALUE 'CLOUDWATCH';
ALTER TYPE "component_type" ADD VALUE 'PARAMETER_STORE';
