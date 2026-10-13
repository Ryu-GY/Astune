"""Small bounded, thread-safe TTL cache; monotonic time avoids clock adjustments."""
from collections import OrderedDict
from threading import RLock
from time import monotonic
from typing import Callable, Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    def __init__(self, maxsize: int, ttl_seconds: float, clock: Callable[[], float] = monotonic):
        self.maxsize = maxsize
        self.ttl_seconds = ttl_seconds
        self.clock = clock
        self._entries: OrderedDict[object, tuple[float, T]] = OrderedDict()
        self._lock = RLock()

    def get_or_create(self, key: object, factory: Callable[[], T]) -> tuple[T, bool]:
        # Single-flight creation also protects TimezoneFinder's shared lookup instance.
        with self._lock:
            now = self.clock()
            if key in self._entries:
                expires, value = self._entries.pop(key)
                if expires > now:
                    self._entries[key] = (expires, value)
                    return value, True
            value = factory()  # Exceptions are never cached.
            self._entries[key] = (self.clock() + self.ttl_seconds, value)
            while len(self._entries) > self.maxsize:
                self._entries.popitem(last=False)
            return value, False
