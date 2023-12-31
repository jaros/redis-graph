import { createClient } from 'redis';

const client = createClient();

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

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

await client.sAdd('u:c:u1', ['c1', 'c5']);
await client.sAdd('u:c:u2', ['c2']);
await client.sAdd('u:c:u3', ['c5', 'c6', 'c7', 'c8']);
await client.sAdd('u:c:u6', ['c6']);
await client.sAdd('u:c:u17', ['c7']);
await client.sAdd('u:c:u18', ['c8']);

await client.sAdd('c:u:c1', ['u1']);
await client.sAdd('c:u:c2', ['u2']);
await client.sAdd('c:u:c5', ['u1', 'u3']);
await client.sAdd('c:u:c6', ['u3', 'u6']);
await client.sAdd('c:u:c7', ['u3', 'u17']);
await client.sAdd('c:u:c8', ['u3', 'u18']);

let scipt = `
-- Lua script to find relations in Redis

local function findRels(userId, maxLevel)
    local rels = {
        users = {},
        devices = {},
        cards = {}
    }

    local users = {userId}
    local seen = {}
    local level = 1
    while level <= maxLevel do
        local devices = {}
        local cards = {}
        local devicesSet = {}
        local cardsSet = {}

        for _, user in ipairs(users) do
            if not seen[user] then
                local uDevices = redis.call('SMEMBERS', 'u:d:' .. user)
                local uCards = redis.call('SMEMBERS', 'u:c:' .. user)
                seen[user] = true

                for _, d in ipairs(uDevices) do
                    if not seen[d] and not devicesSet[d] then
                        devicesSet[d] = true
                        table.insert(devices, d)
                    end
                end

                for _, c in ipairs(uCards) do
                    if not seen[c] and not cardsSet[c] then
                        cardsSet[c] = true
                        table.insert(cards, c)
                    end
                end
            end
        end

        rels.devices[level] = { list = devices, count = #devices }
        rels.cards[level] = { list = cards, count = #cards }

        users = {}
        for _, dev in ipairs(devices) do
            if not seen[dev] then
                local dUsers = redis.call('SMEMBERS', 'd:u:' .. dev)
                seen[dev] = true

                for _, u in ipairs(dUsers) do
                    if not seen[u] then
                        table.insert(users, u)
                    end
                end
            end
        end

        for _, card in ipairs(cards) do
            if not seen[card] then
                local cUsers = redis.call('SMEMBERS', 'c:u:' .. card)
                seen[card] = true

                for _, u in ipairs(cUsers) do
                    if not seen[u] then
                        table.insert(users, u)
                    end
                end
            end
        end

        rels.users[level] = { list = users, count = #users }
        level = level + 1
    end

    return cjson.encode(rels)
end

return findRels(KEYS[1], tonumber(KEYS[2]))
`;

let sriptHash = await client.scriptLoad(scipt);

let res = await client.evalSha(sriptHash, {
    keys: ['u1', '2']
});
// await findRels('u1', 2)

console.log(JSON.parse(res as string))

await client.quit();
