/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      // {
      //   source: '/(.*)',
      //   headers: [
      //     {
      //       key: 'Permissions-Policy',
      //       value:
      //         'camera=(self "https://*.onefootprint.com/*"), publickey-credentials-get=(self "https://*.onefootprint.com/*"), otp-credentials=(self "https://*.onefootprint.com/*"), clipboard-write=(self "https://*.onefootprint.com/*")',
      //     },
      //     {
      //       key: 'Content-Security-Policy',
      //       value:
      //         'child-src onefootprint.com; connect-src *.onefootprint.com; frame-src *.onefootprint.com;',
      //     },
      //   ],
      // },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: '*',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src * data: blob: filesystem: about: ws: wss: 'unsafe-inline' 'unsafe-eval'; script-src * data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src * data: blob: 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src * data: blob: ; style-src * data: blob: 'unsafe-inline'; font-src * data: blob: 'unsafe-inline';",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
