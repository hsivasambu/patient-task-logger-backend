const bcrypt = require("bcryptjs");

async function testBcrypt() {
  const password = "admin123";
  const storedHash =
    "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi";

  console.log("Testing password:", password);
  console.log("Against stored hash:", storedHash);

  const isValid = await bcrypt.compare(password, storedHash);
  console.log("Stored hash is valid for admin123:", isValid);

  // Generate a fresh hash for admin123
  const correctHash = await bcrypt.hash(password, 10);
  console.log("\nCorrect hash for admin123:", correctHash);

  const testCorrectHash = await bcrypt.compare(password, correctHash);
  console.log("New hash works:", testCorrectHash);
}

testBcrypt();
