const { execSync } = require("child_process");

function isAdmin() {
  try {
    execSync("net session", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

module.exports = { isAdmin };
