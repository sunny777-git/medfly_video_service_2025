# worker.py
import multiprocessing
from redis import Redis
from rq import Worker, Queue
import sup_upload_tasks  # ensure it's imported to register function

if __name__ == '__main__':
    multiprocessing.set_start_method("spawn", force=True)

    redis_conn = Redis()
    queue = Queue('default', connection=redis_conn)
    worker = Worker([queue])
    worker.work()