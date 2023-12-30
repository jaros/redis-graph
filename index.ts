import { createClient } from 'redis';

const client = createClient();

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

console.log("Hello via Bun!");

// await client.set('key', 'value');
// const value = await client.get('key');

await client.sAdd('u:d:u1', ['d1', 'd2', 'd3']);
await client.sAdd('u:d:u2', ['d3', 'd4', 'd5']);
await client.sAdd('u:d:u3', ['d5']);
await client.sAdd('u:d:u4', ['d9']);

await client.sAdd('d:u:d1', ['u1']);
await client.sAdd('d:u:d2', ['u1']);
await client.sAdd('d:u:d3', ['u1', 'u2']);
await client.sAdd('d:u:d4', ['u2']);
await client.sAdd('d:u:d5', ['u2', 'u3', 'u6', 'u7', 'u8', 'u9']);
await client.sAdd('d:u:d9', ['u4']);

type Rel = Record<string, {list: string[], count: number}>;

type Rels = {
    users: Rel,
    devices: Rel,
}


let findRels = async (userId: string, maxLevel: number): Promise<Rels> => {
    let rels: Rels = {
        users: {},
        devices: {}
    };

    let users = new Set([userId]);
    let seen = new Set();
    let level = 1;
    while (level <= maxLevel) {
        let devices = new Set<string>();
        for (let user of users) {
            if (seen.has(user)) {
                continue;
            }
            let uDevices = await client.sMembers(`u:d:${user}`);
            seen.add(user);
            for (let d of uDevices) {
                if (!seen.has(d)) {
                    devices.add(d);
                }
            }
        }
        rels.devices[level] = {list: [...devices], count: devices.size}
        users.clear();
        for (let dev of devices) {
            if (seen.has(dev)) {
                continue;
            }
            let dUsers = await client.sMembers(`d:u:${dev}`);
            seen.add(dev);
            for (let u of dUsers) {
                if (!seen.has(u)) {
                    users.add(u);
                } 
            }
        }
        rels.users[level] = {list: [...users], count: users.size}
        level++;
    }

    return rels;
}

console.log(await findRels('u1', 2))

await client.quit();
