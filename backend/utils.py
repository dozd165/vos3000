import re
import locale
import hashlib
import json
import config # For DEFAULT_ENCODING if used by any retained function

# --- Phone Number Classification and Transformation Constants ---

VINAPHONE_PREFIXES_NATIONAL = [
    "91", "94", "88", "81", "82", "83", "84", "85",
]

LANDLINE_02X_PREFIXES_AFTER_0_NATIONAL = [
    "20", "21", "22", "23", "24", "25", "26", "27", "28", "29",
]

MOBILE_SUBSCRIBER_PART_LENGTH = 7
LANDLINE_SUBSCRIBER_PART_MIN_LENGTH = 7

# --- Phone Number Utility Functions ---

def classify_phone_number(phone_number_str: str) -> tuple[str, str, str]:
    cleaned_number = re.sub(r"[^0-9]", "", str(phone_number_str))
    original_cleaned_for_return = cleaned_number

    if not cleaned_number:
        return "Unknown", "", original_cleaned_for_return

    if cleaned_number.startswith("84"):
        number_after_84 = cleaned_number[2:]
        for nat_prefix in VINAPHONE_PREFIXES_NATIONAL:
            if number_after_84.startswith(nat_prefix) and \
               len(number_after_84) == len(nat_prefix) + MOBILE_SUBSCRIBER_PART_LENGTH:
                return "VinaMobile_84", "84" + nat_prefix, original_cleaned_for_return
        
        if number_after_84.startswith("2") and \
           len(number_after_84) >= 1 + LANDLINE_SUBSCRIBER_PART_MIN_LENGTH:
            area_prefix_check = number_after_84[0:2]
            if area_prefix_check in LANDLINE_02X_PREFIXES_AFTER_0_NATIONAL:
                return "Landline_842x", "84" + area_prefix_check, original_cleaned_for_return

    if cleaned_number.startswith("0"):
        number_after_0 = cleaned_number[1:]
        for nat_prefix in VINAPHONE_PREFIXES_NATIONAL:
            if number_after_0.startswith(nat_prefix) and \
               len(number_after_0) == len(nat_prefix) + MOBILE_SUBSCRIBER_PART_LENGTH:
                return "VinaMobile_0", "0" + nat_prefix, original_cleaned_for_return

        if number_after_0.startswith("2") and \
           len(number_after_0) >= 1 + LANDLINE_SUBSCRIBER_PART_MIN_LENGTH:
            area_prefix_check = number_after_0[0:2]
            if area_prefix_check in LANDLINE_02X_PREFIXES_AFTER_0_NATIONAL:
                return "Landline_02x", "0" + area_prefix_check, original_cleaned_for_return
        
        is_processed_vina = any(
            cleaned_number.startswith("0" + vp_prefix) and \
            len(cleaned_number[1:]) == len(vp_prefix) + MOBILE_SUBSCRIBER_PART_LENGTH
            for vp_prefix in VINAPHONE_PREFIXES_NATIONAL
            if cleaned_number[1:].startswith(vp_prefix)
        )
        if len(cleaned_number) == 10 and not is_processed_vina:
            return "Mobile_Other_0", cleaned_number[0:3], original_cleaned_for_return

    for nat_prefix in VINAPHONE_PREFIXES_NATIONAL:
        if cleaned_number.startswith(nat_prefix) and \
           len(cleaned_number) == len(nat_prefix) + MOBILE_SUBSCRIBER_PART_LENGTH:
            return "VinaMobile_NoPrefix", nat_prefix, original_cleaned_for_return

    return "Unknown", "", original_cleaned_for_return

def transform_real_number_for_vos_storage(real_number_str: str) -> str:
    number_type, _, cleaned_original_num = classify_phone_number(real_number_str)

    if not cleaned_original_num:
        return ""

    if number_type.startswith("VinaMobile"):
        if cleaned_original_num.startswith("0") and len(cleaned_original_num) > 1:
            return cleaned_original_num[1:]
        elif cleaned_original_num.startswith("84") and len(cleaned_original_num) > 2:
            num_after_84_check = cleaned_original_num[2:]
            for vp_prefix_check in VINAPHONE_PREFIXES_NATIONAL:
                if num_after_84_check.startswith(vp_prefix_check) and \
                   len(num_after_84_check) == len(vp_prefix_check) + MOBILE_SUBSCRIBER_PART_LENGTH:
                    return num_after_84_check
            return cleaned_original_num 
        return cleaned_original_num

    if number_type == "Landline_02x":
        return "84" + cleaned_original_num[1:]

    if number_type == "Landline_842x":
        return cleaned_original_num

    return cleaned_original_num

def generate_search_variants(original_number_input: str) -> set[str]:
    variants_set = set()
    number_type_class, _, cleaned_original_class = classify_phone_number(original_number_input)

    if not cleaned_original_class:
        return variants_set

    variants_set.add(cleaned_original_class)
    transformed_for_storage = transform_real_number_for_vos_storage(cleaned_original_class)
    variants_set.add(transformed_for_storage)

    if number_type_class.startswith("VinaMobile"):
        base_vina_num = cleaned_original_class
        if cleaned_original_class.startswith("0"):
            base_vina_num = cleaned_original_class[1:]
        elif cleaned_original_class.startswith("84"):
            temp_after_84_vina = cleaned_original_class[2:]
            is_valid_after_84 = any(
                temp_after_84_vina.startswith(vp) and \
                len(temp_after_84_vina) == len(vp) + MOBILE_SUBSCRIBER_PART_LENGTH
                for vp in VINAPHONE_PREFIXES_NATIONAL
            )
            if is_valid_after_84:
                base_vina_num = temp_after_84_vina
        
        is_valid_base = any(
             base_vina_num.startswith(vp) and \
             len(base_vina_num) == len(vp) + MOBILE_SUBSCRIBER_PART_LENGTH
             for vp in VINAPHONE_PREFIXES_NATIONAL
        )
        if is_valid_base:
            variants_set.add(base_vina_num)
            variants_set.add("0" + base_vina_num)
            # variants_set.add("84" + base_vina_num) # Optional: VOS usually doesn't store with 84 for Vina

    elif number_type_class == "Landline_02x": # e.g., 024xxxxxxx
        variants_set.add(cleaned_original_class[1:]) # 24xxxxxxx
        variants_set.add("84" + cleaned_original_class[1:]) # 8424xxxxxxx
        
    elif number_type_class == "Landline_842x": # e.g., 8424xxxxxxx
        num_after_84_landline = cleaned_original_class[2:] # 24xxxxxxx
        if num_after_84_landline.startswith("2") and \
           num_after_84_landline[0:2] in LANDLINE_02X_PREFIXES_AFTER_0_NATIONAL:
            variants_set.add("0" + num_after_84_landline) # 024xxxxxxx
            variants_set.add(num_after_84_landline) # 24xxxxxxx

    elif number_type_class == "Mobile_Other_0": # Other mobile starting with 0
        if cleaned_original_class.startswith("0") and len(cleaned_original_class) > 1:
            variants_set.add(cleaned_original_class[1:]) # Form without 0

    elif number_type_class == "Unknown": # For unknown, add common forms if applicable
        if cleaned_original_class.startswith("0"):
            variants_set.add(cleaned_original_class[1:])
        elif cleaned_original_class.startswith("84"):
            variants_set.add(cleaned_original_class[2:])
            variants_set.add("0" + cleaned_original_class[2:])
        else: # Does not start with 0 or 84
            variants_set.add("0" + cleaned_original_class)
            variants_set.add("84" + cleaned_original_class)
            
    return {v for v in variants_set if v}


# --- Currency Formatting Utility ---

def format_amount_vietnamese_style(amount_value, default_if_error: str = "N/A") -> str:
    try:
        pass 
    except locale.Error:
        pass

    try:
        if isinstance(amount_value, str):
            normalized_value_str = amount_value.lower().strip()
            if normalized_value_str in ["infinity", "không giới hạn", "unlimited", "-1", "-1.0", "-1.00"]:
                return "Unlimited" 
            
            # Attempt to remove thousands separators before parsing, keep last decimal point
            cleaned_str_for_float = amount_value.replace(",", "") 
            if cleaned_str_for_float.count('.') > 1:
                 parts = cleaned_str_for_float.rsplit('.', cleaned_str_for_float.count('.') -1)
                 cleaned_str_for_float = parts[0].replace('.', '') + '.' + parts[1] if len(parts) > 1 else parts[0].replace('.', '')


            val_float = float(cleaned_str_for_float)
            original_str_for_decimal = amount_value 
        elif isinstance(amount_value, (int, float)):
            if amount_value == -1:
                return "Unlimited"
            val_float = float(amount_value)
            original_str_for_decimal = str(amount_value)
        else:
            return default_if_error

        integer_part = int(val_float)
        decimal_part_str = ""

        if "." in original_str_for_decimal:
            parts = original_str_for_decimal.split(".", 1)
            if len(parts) > 1 and parts[1]:
                decimal_part_str = parts[1][:2] 

        formatted_integer = f"{integer_part:,}".replace(",", ".")

        if decimal_part_str and int(decimal_part_str) > 0:
            return f"{formatted_integer},{decimal_part_str.ljust(2, '0')}"
        else:
            return formatted_integer
    except (ValueError, TypeError):
        return str(amount_value) if isinstance(amount_value, str) else default_if_error

# --- Rewrite Rule Processing Utilities ---

def parse_vos_rewrite_rules(rules_string: str | None) -> dict[str, list[str]]:
    virtual_to_real_map: dict[str, list[str]] = {}
    if not rules_string or not isinstance(rules_string, str):
        return virtual_to_real_map

    for pair_segment in rules_string.split(","):
        pair_segment = pair_segment.strip()
        if ":" in pair_segment:
            try:
                virtual_key, reals_segment = pair_segment.split(":", 1)
                virtual_key_cleaned = virtual_key.strip()
                reals_segment_cleaned = reals_segment.strip()

                if not virtual_key_cleaned:
                    continue

                if reals_segment_cleaned.lower() == "hetso": # "hetso" is a VOS specific keyword
                    virtual_to_real_map[virtual_key_cleaned] = ["hetso"]
                else:
                    real_numbers_list = [r.strip() for r in reals_segment_cleaned.split(";") if r.strip()]
                    virtual_to_real_map[virtual_key_cleaned] = real_numbers_list
            except ValueError:
                pass 
            except Exception:
                pass
    return virtual_to_real_map

def format_rewrite_rules_for_vos(virtual_rules_dict: dict[str, list[str]]) -> str:
    rule_components = []
    for v_key, r_list in sorted(virtual_rules_dict.items()):
        if r_list == ["hetso"]: # "hetso" is a VOS specific keyword
            rule_components.append(f"{v_key}:hetso")
        elif isinstance(r_list, list):
            rule_components.append(f"{v_key}:{';'.join(r_list)}")
    return ",".join(rule_components)

# --- Other Utilities ---

def is_six_digit_virtual_number_candidate(number_string: str) -> bool:
    if number_string is None:
        return False
    cleaned_string = str(number_string).strip()
    return cleaned_string.isdigit() and len(cleaned_string) == 6

def generate_object_hash(data_object: dict) -> str:
    """
    Tạo một chuỗi hash SHA256 duy nhất cho một đối tượng (dict).
    Điều này tạo ra một "dấu vân tay" để so sánh các phiên bản của dữ liệu.
    """
    # Sắp xếp các key để đảm bảo chuỗi JSON luôn nhất quán
    dhash = hashlib.sha256()
    encoded = json.dumps(data_object, sort_keys=True).encode()
    dhash.update(encoded)
    return dhash.hexdigest()