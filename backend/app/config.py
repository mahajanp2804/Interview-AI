from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"
    database_url: str = "sqlite+aiosqlite:///./interviewai.db"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    cookie_secure: bool = False   # turn on when served over HTTPS
    log_format: str = "text"      # or "json"
    rate_limits_enabled: bool = True
    db_null_pool: bool = False    # tests open each connection fresh, across event loops
    ai_rate_limit: str = "30/minute"
    auth_rate_limit: str = "10/minute"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
