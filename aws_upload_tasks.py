import os
import boto3
from dotenv import load_dotenv

load_dotenv()

def upload_to_s3(local_path, filename):
    s3 = boto3.client('s3',
                      aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                      aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                      region_name=os.getenv("AWS_S3_REGION"))

    bucket = os.getenv("AWS_S3_BUCKET_NAME")

    try:
        s3.upload_file(local_path, bucket, f"videos/{filename}", ExtraArgs={"ACL": "public-read"})
        os.remove(local_path)
        return f"https://{bucket}.s3.{os.getenv('AWS_S3_REGION')}.amazonaws.com/videos/{filename}"
    except Exception as e:
        print(f"Upload failed: {e}")
        return None
