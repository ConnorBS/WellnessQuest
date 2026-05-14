from pydantic import BaseModel


class VersionOut(BaseModel):
    version: str
    git_sha: str | None = None
    build_timestamp: str | None = None
