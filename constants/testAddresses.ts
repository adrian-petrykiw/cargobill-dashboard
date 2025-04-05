// Test addresses with specific suffixes to simulate different risk scenarios
const testAddresses = {
  sanctioned: '0x7fb49965753A9eC3646fd5d004ee5AeD6Cc89999', // Sanctions Blocklist
  frozen: '0x7fb49965753A9eC3646fd5d004ee5AeD6Cc88888', // Frozen User Wallet
  customBlocklist: '0x7fb49965753A9eC3646fd5d004ee5AeD6Cc87777', // Custom Blocklist Rule
  severeSanctions: '0x7fb49965753A9eC3646fd5d004ee5AeD6Cc88999', // Severe Sanctions Risk
  terroristFinancing: '0x7fb49965753A9eC3646fd5d004ee5AeD6Cc88899', // Severe Terrorist Financing
};
