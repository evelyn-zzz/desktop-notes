const { execFileSync } = require('child_process')
const path = require('path')

// 跳过 Apple 证书签名时，Electron 原始二进制被修改后会导致签名失效；
// 在打包成 .dmg / .zip 前执行 ad-hoc 重签，避免 macOS 报“已损坏/移到废纸篓”。
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)

  execFileSync('xattr', ['-cr', appPath], { stdio: 'inherit' })
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
    stdio: 'inherit'
  })
}
