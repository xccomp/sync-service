  async #scrapeFmvlPilots () {
    return new Promise(function(resolve, reject) {
      const results = []
      const options = {
        separator: ';' ,
        mapHeaders: ({ header }) => {
          const dic = {  
            'Piloto' : 'name',
            'Clube' : 'club',
            'Pendente_Liberacao': 'pending'
          }
          return dic[header] || null
        },
        mapValues: ({ header, value }) => {
          if (header === 'pending') 
            return !value.includes('Liberado')
          else return value
        }
      } 
      fs.createReadStream('./sync-files/pilot-sync-source-fmvl.csv')
      .pipe(csv(options))
      .on('data', data => results.push(data))
      .on('end', () => {
        resolve(results)
      })
    })
  }

  async #scrapeCbvlPilots () {
    return new Promise(function(resolve, reject) {
      const results = []
      const options = {
        separator: ';' ,
        mapHeaders: ({ header }) => {
          const dic = {  
            'id_Check' : 'idCheck',
            'Piloto' : 'name'
          }
          return dic[header] || null
        }
      } 
      fs.createReadStream('./sync-files/pilot-sync-source-cbvl.csv')
      .pipe(csv(options))
      .on('data', data => results.push(data))
      .on('end', () => {
        resolve(results)
      })
    })
  }