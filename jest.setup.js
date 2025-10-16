jest.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    constructor() {}
    async send() {
      return {};
    }
  }

  class GetObjectCommand {
    constructor() {}
  }

  class ListObjectsV2Command {
    constructor() {}
  }

  class PutObjectCommand {
    constructor() {}
  }

  return {
    S3Client,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand
  };
}, { virtual: true });
