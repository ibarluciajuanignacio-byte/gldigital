// Muestra la primera IPv4 no interna (para abrir la app desde el celular en la red local)
const os = require("os");

const nets = os.networkInterfaces();
for (const list of Object.values(nets)) {
  if (!list) continue;
  for (const info of list) {
    if (info.family === "IPv4" && !info.internal) {
      console.log(info.address);
      process.exit(0);
    }
  }
}
console.log("127.0.0.1");
