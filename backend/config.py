import os
import platform

VOS_SERVERS = [

]
DEFAULT_TIMEOUT = 45
DEFAULT_ENCODING = "utf-8"

# --- Server Utility Functions ---

def get_server_info_from_url(url_to_find: str, server_list: list = VOS_SERVERS) -> dict:
    """
    Finds server information (primarily the name) from a URL within a given server list.
    Returns a dictionary with the server's name, or the URL itself if not found.
    """
    for s_info in server_list:
        if s_info.get("url") == url_to_find:
            return s_info
    return {"name": url_to_find, "url": url_to_find}

def get_server_name_from_url(url_to_find: str, server_list: list = VOS_SERVERS) -> str:
    """
    Finds and returns the server name from a URL within a given server list.
    Returns the URL itself if the server is not found in the list.
    """
    server_info = get_server_info_from_url(url_to_find, server_list)
    return server_info.get("name", url_to_find)
