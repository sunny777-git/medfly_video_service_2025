# rq_launcher.py
import multiprocessing as mp
mp.set_start_method("forkserver", force=True)  # must be first, before anything else

import worker  # this will now use forkserver safely
