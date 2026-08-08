-- KEYS[1] = bucket key, e.g. user:123:rate:chat
-- ARGV[1] = userId
-- ARGV[2] = roomId
-- ARGV[3] = tokenCapacity
-- ARGV[4] = initialTokens (capacity - 1, matches your existing seed values)
-- ARGV[5] = refillInterval in ms (10000)
-- ARGV[6] = tokenCost (1)

local key = KEYS[1]
local userId = ARGV[1]
local roomId = ARGV[2]
local capacity = tonumber(ARGV[3])
local initialTokens = tonumber(ARGV[4])
local refillInterval = tonumber(ARGV[5])
local tokenCost = tonumber(ARGV[6])

-- use Redis server time so all replicas/clients agree, instead of client Date.now()
local time = redis.call('TIME')
local nowMs = math.floor(tonumber(time[1]) * 1000 + tonumber(time[2]) / 1000)

local exists = redis.call('EXISTS', key)

if exists == 0 then
    redis.call('HSET', key,
        'userId', userId,
        'roomId', roomId,
        'tokens', initialTokens,
        'last_refill', nowMs
    )
    return { 1, initialTokens, 0 }
end

local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

local elapsed = nowMs - lastRefill
local refilled = math.floor(elapsed / refillInterval)

local newTokens = math.min(capacity, tokens + refilled)

if newTokens < tokenCost then
    local retryAt = refillInterval - (elapsed % refillInterval)
    return { 0, 0 , retryAt }
end

newTokens = newTokens - tokenCost
local newLastRefill = lastRefill + (refilled * refillInterval)

redis.call('HSET', key, 'tokens', newTokens, 'last_refill', newLastRefill)

return { 1, newTokens , 0}