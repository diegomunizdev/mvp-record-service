#!/bin/bash

ENDPOINT="http://localhost:4566"
LOG_GROUP_UPLOAD_NAME=upload-group
LOG_STREAM_NAME=upload-stream

aws --endpoint-url=$ENDPOINT s3 mb s3://mvp-record
aws --endpoint-url=$ENDPOINT logs create-log-group --log-group-name $LOG_GROUP_UPLOAD_NAME && echo "Log group name created successfully"
aws --endpoint-url=$ENDPOINT logs create-log-stream \
  --log-group-name $LOG_GROUP_UPLOAD_NAME \
  --log-stream-name $LOG_STREAM_NAME && echo "Log stream name created successfully"
aws --endpoint-url=$ENDPOINT dynamodb create-table \
  --table-name video_chunk \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=streamId,AttributeType=S \
  --key-schema \
    AttributeName=streamId,KeyType=HASH \
    AttributeName=id,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST > /dev/null && echo "Table created successfully"
  wait
