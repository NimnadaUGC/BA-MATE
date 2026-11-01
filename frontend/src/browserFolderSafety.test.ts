import { describe, expect, it, vi } from 'vitest';
import { get } from 'idb-keyval';
import { writeProjectFiles } from './workspaceFiles';

vi.mock('idb-keyval', () => ({ get: vi.fn(), set: vi.fn() }));

describe('browser folder source copies', () => {
  it('refuses to overwrite an unchecked file when every candidate name exists', async () => {
    const createWritable = vi.fn();
    const directory = { getFileHandle: vi.fn(async (_name: string, options?: { create?: boolean }) => {
      if (options?.create) throw new Error('must not create or overwrite a file');
      return { getFile: async () => ({ arrayBuffer: async () => new Uint8Array([120]).buffer }), createWritable };
    }) };
    vi.mocked(get).mockResolvedValue({ requestPermission: async () => 'granted', getDirectoryHandle: async () => directory });
    await expect(writeProjectFiles({ workspaceId: 'browser-test', workspaceKind: 'browser', folderName: 'test' }, [{ name: 'note.txt', data: 'eQ==' }])).rejects.toThrow('Too many files named note.txt');
    expect(directory.getFileHandle).toHaveBeenCalledTimes(1000);
    expect(createWritable).not.toHaveBeenCalled();
  });

  it('reuses an identical file without opening it for writing', async () => {
    const createWritable = vi.fn();
    const directory = { getFileHandle: vi.fn(async () => ({ getFile: async () => ({ arrayBuffer: async () => new Uint8Array([121]).buffer }), createWritable })) };
    vi.mocked(get).mockResolvedValue({ requestPermission: async () => 'granted', getDirectoryHandle: async () => directory });
    await expect(writeProjectFiles({ workspaceId: 'browser-test', workspaceKind: 'browser', folderName: 'test' }, [{ name: 'note.txt', data: 'eQ==' }])).resolves.toEqual(['Uploaded Sources/note.txt']);
    expect(createWritable).not.toHaveBeenCalled();
  });
});
