from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel


class ProviderInfo(BaseModel):
    kind: str
    label: str


T = TypeVar("T")


class Registry(Generic[T]):
    """Decorator-populated map of kind -> class. Used by both providers and integrations."""

    def __init__(self) -> None:
        self._items: dict[str, type[T]] = {}

    def register(self, cls: type[T]) -> type[T]:
        kind = getattr(cls, "kind", None)
        if not kind:
            raise ValueError(f"{cls.__name__} is missing a `kind` attribute")
        if kind in self._items:
            raise ValueError(f"duplicate registration for kind={kind!r}")
        self._items[kind] = cls
        return cls

    def get(self, kind: str) -> type[T]:
        try:
            return self._items[kind]
        except KeyError as exc:
            raise LookupError(f"unknown kind: {kind!r}") from exc

    def kinds(self) -> list[str]:
        return list(self._items)

    def info(self) -> list[ProviderInfo]:
        return [
            ProviderInfo(kind=getattr(c, "kind"), label=getattr(c, "label", getattr(c, "kind")))
            for c in self._items.values()
        ]
