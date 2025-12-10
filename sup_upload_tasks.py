import os
import uuid
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import timedelta
load_dotenv()

# SUPABASE_URL = os.getenv("SUPABASE_URL")
# SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE")
# SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET")

# supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
def upload_to_supabase(local_path, filename):
    print(f"[upload_to_supabase] Uploading: {local_path} as {filename}")
    try:
        with open(local_path, "rb") as f:
            # Simplify: upload to bucket root as filename
            res = supabase.storage.from_(os.getenv('SUPABASE_BUCKET')).upload(filename, f)
        # Log full response
        print("[upload_to_supabase] Response:", res)
    except Exception as e:
        # Catch HTTPX JSON errors and others
        print("[upload_to_supabase] Exception:", repr(e))
        try:
            # If error has response, show status and body
            resp = e.response
            print("[upload_to_supabase] Status code:", resp.status_code)
            print("[upload_to_supabase] Body:", resp.text)
        except Exception:
            pass
    finally:
        # Always attempt to delete local file
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
                print(f"[upload_to_supabase] Deleted local file: {local_path}")
            except Exception as e:
                print("[upload_to_supabase] Failed to delete local file:", e)
