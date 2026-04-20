from __future__ import annotations

from typing import Iterator, TypeVar

T = TypeVar("T")


def chunks(lst: list[T], size: int) -> Iterator[list[T]]:
    """Divide uma lista em sub-listas de tamanho máximo `size`."""
    for i in range(0, len(lst), size):
        yield lst[i : i + size]
