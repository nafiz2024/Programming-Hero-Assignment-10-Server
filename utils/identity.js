const normalizeId = (value) => String(value ?? "").trim();

const getUserId = (user) => {
  if (!user) {
    return "";
  }

  return normalizeId(user.id || user._id);
};

export { getUserId, normalizeId };
