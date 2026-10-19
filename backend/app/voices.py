VOICES: list[dict[str, str]] = [
    {"id": "zh-CN-XiaoxiaoNeural", "name": "晓晓", "gender": "女声", "tone": "温暖自然"},
    {"id": "zh-CN-XiaoyiNeural", "name": "晓伊", "gender": "女声", "tone": "清晰明快"},
    {"id": "zh-CN-XiaochenNeural", "name": "晓辰", "gender": "女声", "tone": "亲切闲聊"},
    {"id": "zh-CN-XiaohanNeural", "name": "晓涵", "gender": "女声", "tone": "知性温和"},
    {"id": "zh-CN-YunxiNeural", "name": "云希", "gender": "男声", "tone": "年轻活力"},
    {"id": "zh-CN-YunjianNeural", "name": "云健", "gender": "男声", "tone": "沉稳磁性"},
    {"id": "zh-CN-YunyangNeural", "name": "云扬", "gender": "男声", "tone": "新闻播音"},
    {"id": "zh-CN-YunxiaNeural", "name": "云夏", "gender": "男声", "tone": "清朗少年"},
]

VOICE_MAP = {voice["id"]: voice for voice in VOICES}
DEFAULT_VOICE_ID = VOICES[0]["id"]
